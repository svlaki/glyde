declare module 'chrono-node' {
  export interface ParsedComponent {
    date(): Date;
    isCertain(component: string): boolean;
  }

  export interface ParsedResult {
    start: ParsedComponent;
    end?: ParsedComponent;
    text: string;
    index: number;
  }

  export interface ParseOptions {
    forwardDate?: boolean;
  }

  export function parse(text: string, referenceDate?: Date, options?: ParseOptions): ParsedResult[];
}