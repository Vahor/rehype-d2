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
  .use(rehypeD2, { strategy: 'inline-png', cwd: process.cwd(), renderOptions: { sketch: true } })
  .process(...)
```

### Options

- `strategy`: The strategy to use for rendering the diagrams.
  - `'inline-svg'`: Replace the diagram with an inline SVG. This is the default. *Recommended*.
  - `'inline-png'`: Replace the diagram with an inline PNG, the image source will be a data URI of the svg.

- `cwd`: The current working directory to use for resolving relative paths. Used for imports inside D2 diagrams.
  - Default: `process.cwd()`

- `renderOptions`: The options to pass to the D2 renderer. See [D2 Render Options](https://github.com/terrastruct/d2/blob/0b2203c107df5319380c1d72753ae8c7814324d9/d2js/js/index.d.ts#L8-L31)

## Example in markdown

```html
<code class="language-d2">
a: From
b: To
a -> b: Message
</code>
```

If you want to use this plugin in markdown, you can first use a rehype plugin to parse the markdown into HTML, then use this plugin to convert the HTML to SVG.

# Acknowledgements

- [Rehype Mermaid](https://github.com/remcohaszing/rehype-mermaid) For the inspiration.
