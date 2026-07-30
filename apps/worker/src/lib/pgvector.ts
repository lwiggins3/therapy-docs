/** pgvector's text input format for a vector literal: `[1,2,3]`. */
export function toPgVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
