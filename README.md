# rehype-d2

[![Code quality](https://github.com/Vahor/rehype-d2/actions/workflows/quality.yml/badge.svg)](https://github.com/Vahor/rehype-d2/actions/workflows/quality.yml)
[![npm downloads](https://img.shields.io/npm/dm/%40vahor%2Frehype-d2)](https://www.npmjs.com/package/@vahor/rehype-d2)

A [Rehype](https://github.com/rehypejs/rehype) plugin to convert [D2](https://d2lang.com/) diagrams to SVG or PNG.

## Installation

```sh
bun install @vahor/rehype-d2
```

## Usage

```js
import { rehype } from 'rehype'
import rehypeD2 from '@vahor/rehype-d2'

const processor = await rehype()
  .use(rehypeD2, { strategy: 'inline-svg', cwd: "d2", defaultMetadata: { layout: "elk", sketch: true, pad: 0 } })
  .process(...)
```

### Options

- `strategy`: The strategy to use for rendering the diagrams.
  - `'inline-svg'`: Replace the diagram with an inline SVG. This is the default. *Recommended*.
  - `'inline-png'`: Replace the diagram with an inline PNG, the image source will be a data URI of the svg.

- `cwd`: The working directory to use for to resolve imports.
   - If not provided, imports won't be available.

- `defaultMetadata`: The options to pass to the D2 renderer. See [D2 Render Options](https://github.com/terrastruct/d2/blob/0b2203c107df5319380c1d72753ae8c7814324d9/d2js/js/index.d.ts#L8-L44)

- `globalImports`: A list of imports to add to the D2 renderer. Requires `cwd` to be set.
  - Example: `["vars.d2"]`, will _prepend_ `...@vars` to every diagram before rendering.

# Examples

You can pass any props to the code block, this will override the `defaultMetadata` option.

```html
<code class="language-d2" title="This is a diagram" alt="This is a description" width="200" height="100">
...@vars

a: From
b: To
a -> b: Message
</code>
```


When using [remark](https://github.com/remarkjs/remark) to process markdown and transform it into HTML, metadata fields can also be used:

~~~md
```d2 width=200 height=100 title="This is a diagram" alt="This is a description"
...@vars

a: From
b: To
a -> b: Message
```
~~~

This will generate the following HTML:

When using `inline-svg`:
```html
<svg aria-label="This is a description" width="200" height="100">
  ...
</svg>
```

When using `inline-png`:
```html
<img src="data:image/svg+xml,..." alt="This is a description" title="This is a diagram" width="200" height="100">
```

See other examples in the fixtures directory [`tests/fixtures`](https://github.com/Vahor/rehype-d2/tree/main/tests/fixtures) and [`tests/output`](https://github.com/Vahor/rehype-d2/tree/main/tests/output) to see the generated HTML.

# Roadmap

- Reduce the size of the generated SVGs. Currently each diagram contains the fonts, and colors even if they are already defined in another diagram or globally in the html page.

# Integration with other tools

- If you already have a rehype plugin that process code blocks, I suggest placing `rehype-d2` first, so that the code block is unchanged.
- When using with [contentlayer](https://github.com/timlrx/contentlayer2). You might have to patch the `contentlayer` library to avoid bundling the `d2` library. See [issue](https://github.com/timlrx/contentlayer2/issues/70)

# Acknowledgements

- [Rehype Mermaid](https://github.com/remcohaszing/rehype-mermaid) For the inspiration.
