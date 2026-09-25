/**
 * A traceback's parts, for colouring an error in an output block
 * (`BO_0296_019`): the exception's name, each frame's file, line and
 * function, the pointed line and the markers — found by the shape of the
 * lines, so a reader's page needs no grammar for it. Two shapes are known,
 * Python's own (`File "x.py", line 3, in f`) and IPython's, which is what a
 * Jupyter kernel answers (`NameError   Traceback (most recent call last)`,
 * `Cell In[1], line 2`, `File ~/x.py:12, in f(x)`, `----> 2 asdadfa` and a
 * dashed rule). Every character of the text is in the segments, in order, so
 * what is drawn is what the kernel said.
 */
export type TracebackKind = "text" | "heading" | "file" | "line" | "frame" | "exception" | "marker";

/** ANSI colour escapes a kernel's traceback carries, stripped for reading:
 * the colour is this side's to give, by the lines' shape. */
const ANSI = /\u001b\[[0-9;]*m/gu;
export const stripEscapes = (line: string): string => line.replace(ANSI, "");

export interface TracebackSegment {
  readonly kind: TracebackKind;
  readonly text: string;
}

/** Python's frame: `  File "x.py", line 3, in f`. */
const FRAME = /^(\s*File )("[^"\n]*")(, line )(\d+)(?:(, in )(\S+))?(.*)$/u;
/** IPython's file frame: `File ~/x.py:12, in f(x)`. */
const IPYTHON_FILE = /^(\s*File )(\S+?):(\d+)(?:(, in )(.+))?$/u;
/** IPython's cell frame: `Cell In[1], line 2`. */
const IPYTHON_CELL = /^(\s*Cell )(In\[\d+\])(, line )(\d+)(.*)$/u;
/** IPython's pointed code line: `----> 2 asdadfa`. Its unpointed context
 * lines (`      1 x = 1`) stay plain, since a plain Python source line may
 * begin with a number too. */
const POINTED = /^(-+> )(\d+)( .*|)$/u;
const MARKER = /^\s*[\^~]+\s*$|^-{5,}$/u;
const HEADING = /^Traceback \(most recent call last\):?\s*$/u;
/** IPython's first line: the exception, then the heading after a run of spaces. */
const IPYTHON_HEADING = /^([A-Z][\w.]*)(\s{2,}Traceback \(most recent call last\)\s*)$/u;
const EXCEPTION = /^([A-Z][\w.]*)(:.*|)$/u;

const part = (kind: TracebackKind, text: string | undefined): TracebackSegment[] => (text === undefined || text === "" ? [] : [{ kind, text }]);

function segmentsOfLine(line: string): TracebackSegment[] {
  if (line === "") return [];
  if (HEADING.test(line)) return [{ kind: "heading", text: line }];
  if (MARKER.test(line)) return [{ kind: "marker", text: line }];
  const first = IPYTHON_HEADING.exec(line);
  if (first !== null) return [...part("exception", first[1]), ...part("heading", first[2])];
  const frame = FRAME.exec(line);
  if (frame !== null) {
    const [, before, file, comma, number, inWord, name, rest] = frame;
    return [...part("text", before), ...part("file", file), ...part("text", comma), ...part("line", number), ...part("text", inWord), ...part("frame", name), ...part("text", rest)];
  }
  const cell = IPYTHON_CELL.exec(line);
  if (cell !== null) {
    const [, before, name, comma, number, rest] = cell;
    return [...part("text", before), ...part("file", name), ...part("text", comma), ...part("line", number), ...part("text", rest)];
  }
  const ipythonFile = IPYTHON_FILE.exec(line);
  if (ipythonFile !== null) {
    const [, before, file, number, inWord, name] = ipythonFile;
    return [...part("text", before), ...part("file", file), ...part("text", ":"), ...part("line", number), ...part("text", inWord), ...part("frame", name)];
  }
  const pointed = POINTED.exec(line);
  if (pointed !== null) {
    const [, arrow, number, code] = pointed;
    return [...part("marker", arrow), ...part("line", number), ...part("text", code)];
  }
  const exception = EXCEPTION.exec(line);
  if (exception !== null) {
    const [, name, rest] = exception;
    return [...part("exception", name), ...part("text", rest)];
  }
  return [{ kind: "text", text: line }];
}

export function tracebackSegments(text: string): TracebackSegment[] {
  const segments: TracebackSegment[] = [];
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    segments.push(...segmentsOfLine(line));
    if (index < lines.length - 1) segments.push({ kind: "text", text: "\n" });
  });
  // Adjacent text runs joined, so the drawing holds as few nodes as the
  // colour needs.
  return segments.reduce<TracebackSegment[]>((joined, segment) => {
    const last = joined[joined.length - 1];
    if (last !== undefined && last.kind === "text" && segment.kind === "text") {
      joined[joined.length - 1] = { kind: "text", text: last.text + segment.text };
    } else if (segment.text !== "") {
      joined.push(segment);
    }
    return joined;
  }, []);
}
