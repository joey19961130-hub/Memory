declare module 'mp4box' {
  export interface MP4MediaTrack {
    id: number;
    codec: string;
    timescale: number;
    duration: number;
    nb_samples: number;
    video?: { width: number; height: number };
    track_width: number;
    track_height: number;
  }

  export interface MP4Info {
    duration: number;
    timescale: number;
    videoTracks: MP4MediaTrack[];
    tracks: MP4MediaTrack[];
  }

  export interface MP4Sample {
    number: number;
    track_id: number;
    timescale: number;
    cts: number;
    dts: number;
    duration: number;
    is_sync: boolean;
    data: Uint8Array;
  }

  export type MP4ArrayBuffer = ArrayBuffer & { fileStart: number };

  export interface MP4Box {
    write(stream: DataStream): void;
  }

  export interface MP4SampleEntry {
    avcC?: MP4Box;
    hvcC?: MP4Box;
    vpcC?: MP4Box;
    av1C?: MP4Box;
  }

  export interface MP4Trak {
    mdia: { minf: { stbl: { stsd: { entries: MP4SampleEntry[] } } } };
  }

  export interface MP4File {
    onReady?: (info: MP4Info) => void;
    onError?: (e: string) => void;
    onSamples?: (id: number, user: unknown, samples: MP4Sample[]) => void;
    appendBuffer(data: MP4ArrayBuffer): number;
    start(): void;
    stop(): void;
    flush(): void;
    getTrackById(id: number): MP4Trak;
    setExtractionOptions(id: number, user?: unknown, options?: { nbSamples?: number }): void;
  }

  export class DataStream {
    constructor(buffer?: ArrayBuffer, byteOffset?: number, endianness?: boolean);
    static BIG_ENDIAN: boolean;
    static LITTLE_ENDIAN: boolean;
    buffer: ArrayBuffer;
  }

  export function createFile(): MP4File;

  const MP4Box: {
    createFile: typeof createFile;
    DataStream: typeof DataStream;
  };
  export default MP4Box;
}
