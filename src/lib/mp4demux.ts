import MP4Box, { DataStream, type MP4ArrayBuffer, type MP4File, type MP4Sample } from 'mp4box';

export interface DemuxedTrack {
  codec: string;
  width: number;
  height: number;
  /** Seconds */
  duration: number;
  description?: Uint8Array;
  samples: MP4Sample[];
}

/** avcC / hvcC / vpcC / av1C box payload (without the 8-byte box header) for VideoDecoder.description */
function getDescription(file: MP4File, trackId: number): Uint8Array | undefined {
  const trak = file.getTrackById(trackId);
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
    if (box) {
      const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
      box.write(stream);
      return new Uint8Array(stream.buffer, 8);
    }
  }
  return undefined;
}

/** Parse a fully downloaded MP4 and return its first video track with every sample. */
export function demuxVideo(buffer: ArrayBuffer): DemuxedTrack {
  const file = MP4Box.createFile();
  let result: DemuxedTrack | null = null;
  let error: string | null = null;

  file.onError = (e) => {
    error = e;
  };
  file.onReady = (info) => {
    const track = info.videoTracks[0];
    if (!track) {
      error = 'no video track';
      return;
    }
    result = {
      codec: track.codec,
      width: track.video?.width ?? track.track_width,
      height: track.video?.height ?? track.track_height,
      duration: track.duration / track.timescale,
      description: getDescription(file, track.id),
      samples: [],
    };
    file.onSamples = (_id, _user, samples) => {
      result!.samples.push(...samples);
    };
    file.setExtractionOptions(track.id, null, { nbSamples: Infinity });
    file.start();
  };

  const ab = buffer.slice(0) as MP4ArrayBuffer;
  ab.fileStart = 0;
  file.appendBuffer(ab);
  file.flush();

  if (error) throw new Error(`mp4 parse failed: ${error}`);
  if (!result) throw new Error('mp4 parse failed: moov not found');
  return result;
}
