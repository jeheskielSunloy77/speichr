export type VisualizerDataType = 'raw' | 'json' | 'dsv'

export type VisualizerDetection =
	| {
			type: 'raw'
	}
	| {
			type: 'json'
			value: unknown
	}
	| {
			type: 'dsv'
			delimiter: string
			rows: string[][]
			hasHeader: boolean
	}

const DELIMITER_CANDIDATES = [',', ';', '|', '\t']

const normalizeLines = (value: string): string[] =>
	value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)

export const normalizeDelimiter = (value: string): string => {
	if (value === '\\t') {
		return '\t'
	}

	if (value.length === 0) {
		return ','
	}

	return value
}

export const parseDelimiterSeparated = (
	value: string,
	delimiter: string,
): string[][] => {
	const lines = normalizeLines(value)
	if (lines.length === 0) {
		return []
	}

	return lines.map((line) => line.split(delimiter).map((cell) => cell.trim()))
}

const isNumericLike = (value: string): boolean => {
	if (value.trim().length === 0) {
		return false
	}

	const parsed = Number(value)
	return Number.isFinite(parsed)
}

const guessHasHeaderRow = (rows: string[][]): boolean => {
	if (rows.length < 2) {
		return false
	}

	const first = rows[0]
	const second = rows[1]
	const firstLooksLabelLike = first.every(
		(cell) => cell.length > 0 && !isNumericLike(cell),
	)
	const secondLooksDataLike = second.some((cell) => isNumericLike(cell))

	return firstLooksLabelLike && secondLooksDataLike
}

const detectDelimiterSeparated = (value: string):
	| {
			delimiter: string
			rows: string[][]
			hasHeader: boolean
	}
	| null => {
	const lines = normalizeLines(value)
	if (lines.length < 2) {
		return null
	}

	let best:
		| {
				delimiter: string
				rows: string[][]
				score: number
			}
		| null = null

	for (const delimiter of DELIMITER_CANDIDATES) {
		const rows = parseDelimiterSeparated(value, delimiter)
		if (rows.length < 2) {
			continue
		}

		const counts = rows.map((row) => row.length)
		const frequencies = new Map<number, number>()
		for (const count of counts) {
			frequencies.set(count, (frequencies.get(count) ?? 0) + 1)
		}

		const [mostFrequentColumns, consistency] = Array.from(
			frequencies.entries(),
		).sort((left, right) => right[1] - left[1])[0]

		if (!mostFrequentColumns || mostFrequentColumns < 2 || consistency < 2) {
			continue
		}

		const score = mostFrequentColumns * consistency
		if (!best || score > best.score) {
			best = {
				delimiter,
				rows,
				score,
			}
		}
	}

	if (!best) {
		return null
	}

	return {
		delimiter: best.delimiter,
		rows: best.rows,
		hasHeader: guessHasHeaderRow(best.rows),
	}
}

export const parseJsonValue = (
	value: string,
): { value?: unknown; error?: string } => {
	try {
		return {
			value: JSON.parse(value),
		}
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : 'Invalid JSON value.',
		}
	}
}

export const detectValueStructure = (value: string): VisualizerDetection => {
	const trimmed = value.trim()
	if (!trimmed) {
		return {
			type: 'raw',
		}
	}

	const parsedJson = parseJsonValue(value)
	const jsonValue = parsedJson.value
	const isStructuredJson =
		Array.isArray(jsonValue) ||
		(typeof jsonValue === 'object' && jsonValue !== null)
	if (isStructuredJson) {
		return {
			type: 'json',
			value: jsonValue,
		}
	}

	const dsv = detectDelimiterSeparated(value)
	if (dsv) {
		return {
			type: 'dsv',
			delimiter: dsv.delimiter,
			rows: dsv.rows,
			hasHeader: dsv.hasHeader,
		}
	}

	return {
		type: 'raw',
	}
}
