export interface PhonemizeModule {
  callMain(args: string[]): number;
}
export function createPiperPhonemize(options: Record<string, unknown>): Promise<PhonemizeModule>;
