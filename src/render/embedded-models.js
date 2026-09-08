// Restore a gzip-compressed GLB without fetching a file or a network URL.
export async function decodeEmbeddedModel(encoded) {
  if (typeof encoded !== 'string' || !encoded.length) throw new Error('Missing embedded model data');
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This offline file requires a browser with gzip decompression support');
  }
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}
