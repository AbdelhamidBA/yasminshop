// Renders a structured-data block.
//
// dangerouslySetInnerHTML is required and correct here: React escapes text
// children, which would turn the JSON's quotes into &quot; and leave crawlers
// with an unparseable script. The payload is BUILT by us from typed values —
// never taken from a request — and JSON.stringify cannot emit a raw `<`, so the
// one injection route left is a literal "</script>" inside a string value.
// That sequence is escaped below, which is the standard mitigation.
export function JsonLd({data}: {data: Record<string, unknown> | Record<string, unknown>[]}) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      // suppressHydrationWarning: the markup is identical on both sides, but
      // the attribute keeps a whitespace-normalising extension from tripping it.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{__html: json}}
    />
  );
}
