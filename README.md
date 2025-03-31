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
  .use(rehypeD2, { strategy: 'inline-svg', cwd: "d2", defaultMetadata: { default: { layout: "elk", sketch: true, pad: 0 } } })
  .process(...)
```

### Options

- `strategy`: The strategy to use for rendering the diagrams.
  - `'inline-svg'`: Replace the diagram with an inline SVG. This is the default. *Recommended*.
  - `'inline-png'`: Replace the diagram with an inline PNG, the image source will be a data URI of the svg.

- `cwd`: The working directory to use for to resolve imports.
   - If not provided, imports won't be available.

- `defaultThemes`: The themes to use if no themes are specified in the metadata. Default is `["default"]`.

- `defaultMetadata`: The options to pass to the D2 renderer. See [D2 Render Options](https://github.com/terrastruct/d2/blob/0b2203c107df5319380c1d72753ae8c7814324d9/d2js/js/index.d.ts#L8-L44)
  - Dictionary of themes, each theme is a key.

- `globalImports`: A list of imports to add to the D2 renderer. Requires `cwd` to be set.
  - Dictionary of themes, each theme is a key.
  - Example: `{ light: ["light.d2"], dark: ["dark.d2"] }`, will prepend the content diagram with `...@light.d2` and `...@dark.d2` respective to the theme.
  - Sometimes using the import syntax can be limiting, for example if you want a `*` selector to also effect other files. In this case you can use the include syntax: `{ light: [{ filename: "light.d2", mode: "prepend" }], dark: [{ filename: "dark.d2", mode: "prepend" }] }`. When using `prepend` the whole file will be prepended as if it was always a single file. (default value is equivalent to `mode: "impot"`



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

## Light and dark themes

The default theme is `default`.

When using multiple themes, this plugin will generate a svg or png for each theme.
It's up to you to define the css to hide or show the diagrams.

For example, if you have a light and dark theme, you can use the following css to hide the light theme:

```css
.dark [data-d2-theme]:not([data-d2-theme="dark"]) {
	display: none;
}
.light [data-d2-theme]:not([data-d2-theme="light"]) {
	display: none;
}
```

Example with markdown:

~~~md
```d2 themes=dark,light
a: From
b: To
a -> b: Message
```
~~~

This will generate the following HTML:

```html
<svg data-d2-theme="dark">
  ...
</svg>
<svg data-d2-theme="light">
  ...
</svg>
```

# Roadmap

- Reduce the size of the generated SVGs. Currently each diagram contains the fonts, and colors even if they are already defined in another diagram or globally in the html page.

# Integration with other tools

- If you already have a rehype plugin that process code blocks, I suggest placing `rehype-d2` first, so that the code block is unchanged.
- When using with [contentlayer](https://github.com/timlrx/contentlayer2). You might have to patch the `contentlayer` library to avoid bundling the `d2` library. See [issue](https://github.com/timlrx/contentlayer2/issues/70)

# Who is using rehype-d2?

- [vahor.fr](https://vahor.fr/project/rehype-d2) [(source)](https://github.com/Vahor/vahor.fr/blob/ef2d0054c334bfe7e03f2779b348bf73b0a39d3e/contentlayer.config.ts#L186-L211) <sub>well that's me</sub>

# Acknowledgements

- [Rehype Mermaid](https://github.com/remcohaszing/rehype-mermaid) For the inspiration.
