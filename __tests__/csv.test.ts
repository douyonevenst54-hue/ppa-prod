import { describe, it, expect } from "vitest";
import {
  parseCsv,
  toCsv,
  csvRow,
  headerIndex,
  requireColumns,
} from "@/lib/csv";

const HEADER = ["verdict", "corrected_answer", "text", "answer_key", "options"];

describe("parseCsv / toCsv round trip", () => {
  const nasty: string[][] = [
    ["", "", "Which costs more, A or B?", "A", "A | B"],
    ["ok", "", 'He said "hello" — then left', '"hello"', '"hello" | goodbye'],
    ["fix", "42", "What is 6 x 7, exactly?", "41", "40 | 41 | 42 | 43"],
    ["", "", "Line one\nLine two inside a cell", "x", "x | y"],
    ["bad", "", 'Comma, quote " and newline\nat once', "a", "a | b"],
  ];

  it("survives commas, quotes and embedded newlines", () => {
    const back = parseCsv(toCsv(HEADER, nasty));
    expect(back[0]).toEqual(HEADER);
    expect(back.slice(1)).toEqual(nasty);
  });

  it("reads CRLF the same as LF", () => {
    const lf = toCsv(HEADER, nasty);
    expect(parseCsv(lf.replace(/\n/g, "\r\n"))).toEqual(parseCsv(lf));
  });

  it("strips the BOM Excel writes, so the first column keeps its name", () => {
    const withBom = "﻿" + toCsv(HEADER, nasty);
    expect(parseCsv(withBom)[0][0]).toBe("verdict");
  });

  it("ignores trailing blank lines instead of inventing rows", () => {
    const csv = toCsv(HEADER, nasty);
    expect(parseCsv(csv + "\n\n\n")).toHaveLength(nasty.length + 1);
  });

  it("keeps empty cells rather than shifting later columns left", () => {
    const parsed = parseCsv(csvRow(["a", "", "", "d"]));
    expect(parsed[0]).toEqual(["a", "", "", "d"]);
  });

  it("does not treat a quote inside an unquoted value as an escape", () => {
    // A hand-edited file can contain this; it must not swallow the rest.
    const parsed = parseCsv(toCsv(["a", "b"], [['6" nail', "done"]]));
    expect(parsed[1]).toEqual(['6" nail', "done"]);
  });
});

describe("headerIndex / requireColumns", () => {
  it("addresses columns by name, not position", () => {
    const i = headerIndex(["Text", "ANSWER_KEY", " options "]);
    expect(i.get("text")).toBe(0);
    expect(i.get("answer_key")).toBe(1);
    expect(i.get("options")).toBe(2);
  });

  it("survives columns being reordered in a spreadsheet", () => {
    const i = headerIndex(["options", "text", "answer_key"]);
    expect(i.get("text")).toBe(1);
    expect(requireColumns(i, ["text", "options", "answer_key"])).toEqual([]);
  });

  it("names what is missing", () => {
    const i = headerIndex(["text"]);
    expect(requireColumns(i, ["text", "answer_key", "options"])).toEqual([
      "answer_key",
      "options",
    ]);
  });

  it("ignores blank header cells", () => {
    const i = headerIndex(["text", "", "options"]);
    expect(i.has("")).toBe(false);
    expect(i.get("options")).toBe(2);
  });
});
