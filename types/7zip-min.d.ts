declare module '7zip-min' {
  export function unpack(
    archive: string,
    targetDir: string,
    callback: (err: Error | null) => void
  ): void

  export function pack(
    targetDir: string,
    archive: string,
    callback: (err: Error | null) => void
  ): void

  export function list(
    archive: string,
    callback: (err: Error | null, result: any[]) => void
  ): void

  export function cmd(
    commands: string[],
    callback: (err: Error | null, result: any) => void
  ): void
}
