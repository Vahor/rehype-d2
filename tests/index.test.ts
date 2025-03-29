import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { rehype } from "rehype";
import { VFile } from "vfile";
import rehypeD2 from "../src/index.ts";

describe("types", () => {
	test("fails if strategy is invalid", () => {
		const processor = rehype().use(rehypeD2, { strategy: "invalid" });

		expect(() => processor.processSync("")).toThrowErrorMatchingSnapshot();
	});
	test("fails if cwd is not provided when using imports", () => {
		const processor = rehype().use(rehypeD2, {
			strategy: "inline-svg",
		});

		const vFile = new VFile({
			path: "test.html",
			value: '<code class="language-d2">\n...@vars\n</code>',
		});

		expect(
			async () => await processor.process(vFile),
		).toThrowErrorMatchingSnapshot();
	});
});

describe("renders", async () => {
	const fixtures = readdirSync("tests/fixtures");

	const options = {
		cwd: "tests/imports",
	};

	for (const fixture of fixtures) {
		const fixtureContent = await Bun.file(`tests/fixtures/${fixture}`).text();
		describe(fixture, () => {
			test("renders to inline-svg", async () => {
				const processor = rehype().use(rehypeD2, {
					...options,
					strategy: "inline-svg",
				});
				const result = await processor.process(fixtureContent);
				expect(result.value).toMatchSnapshot();
				if (process.env.CI !== "true") {
					Bun.write(`tests/output/${fixture}-inline-svg.html`, result.value);
				}
			});
			test("renders to inline-png", async () => {
				const processor = rehype().use(rehypeD2, {
					...options,
					strategy: "inline-png",
				});
				const result = await processor.process(fixtureContent);
				expect(result.value).toMatchSnapshot();
				if (process.env.CI !== "true") {
					Bun.write(`tests/output/${fixture}-inline-png.html`, result.value);
				}
			});
		});
	}
});
