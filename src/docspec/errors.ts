export class DocspecError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
  ) {
    super(`${message} (${filePath})`);
    this.name = 'DocspecError';
  }
}
