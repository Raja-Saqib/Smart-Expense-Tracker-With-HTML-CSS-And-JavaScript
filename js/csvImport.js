import { deviceId } from "./deviceIdentity.js";
import {
  DEFAULT_CURRENCY,
  isSupportedCurrency
} from "./currency.js";

const REQUIRED_HEADERS = [
    "description",
    "category",
    "amount",
    "date"
];

const normalizeHeader = value =>
    String(value ?? "")
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase();

const normalizeText = value =>
    String(value ?? "").trim();

const parseCSV = text => {
    const rows = [];
    let row = [];
    let value = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (insideQuotes && next === '"') {
                value += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }

            continue;
        }

        if (char === "," && !insideQuotes) {
            row.push(value);
            value = "";
            continue;
        }

        if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {
            if (char === "\r" && next === "\n") {
                i++;
            }

            row.push(value);
            value = "";

            if (
                row.some(cell =>
                    String(cell).trim() !== ""
                )
            ) {
                rows.push(row);
            }

            row = [];
            continue;
        }

        value += char;
    }

    if (insideQuotes) {
        throw new Error(
            "CSV contains an unterminated quoted field"
        );
    }

    if (value !== "" || row.length) {
        row.push(value);

        if (
            row.some(cell =>
                String(cell).trim() !== ""
            )
        ) {
            rows.push(row);
        }
    }

    return rows;
};

const parseAmount = value => {
    const raw = normalizeText(value);

    if (!raw) {
        return null;
    }

    /*
     * Supports:
     * - 500
     * - -500
     * - 500.50
     * - -500.50
     * - 1,500
     * - -1,500.50
     */
    const normalized = raw.replace(/,/g, "");

    if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
        return null;
    }

    const amount = Number(normalized);

    if (!Number.isFinite(amount) || amount === 0) {
        return null;
    }

    return amount;
};

const createDateFromParts = (
    year,
    month,
    day
) => {
    const date = new Date(
        year,
        month - 1,
        day
    );

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    date.setHours(12, 0, 0, 0);

    return date;
};

const parseDate = value => {
    const raw = normalizeText(value);

    if (!raw) {
        return null;
    }

    /*
     * ISO:
     * 2026-09-13
     * 2026-09-13T12:30:00.000Z
     */
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const isoDate = new Date(raw);

        if (!Number.isNaN(isoDate.getTime())) {
            return isoDate.toISOString();
        }

        return null;
    }

    /*
     * YYYY/MM/DD
     */
    let match = raw.match(
        /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
    );

    if (match) {
        const date = createDateFromParts(
            Number(match[1]),
            Number(match[2]),
            Number(match[3])
        );

        return date ? date.toISOString() : null;
    }

    /*
     * Locale-style dates:
     *
     * MM/DD/YYYY
     * DD/MM/YYYY
     *
     * The exporter currently uses toLocaleDateString(),
     * so ambiguous dates are interpreted according to
     * the browser locale.
     */
    match = raw.match(
        /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
    );

    if (!match) {
        return null;
    }

    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);

    let month;
    let day;

    if (first > 12) {
        day = first;
        month = second;
    } else if (second > 12) {
        month = first;
        day = second;
    } else {
        const locale =
            Intl.DateTimeFormat()
                .resolvedOptions()
                .locale
                .toLowerCase();

        /*
         * en-US commonly uses MM/DD/YYYY.
         * Most other locales use DD/MM/YYYY.
         */
        if (locale.startsWith("en-us")) {
            month = first;
            day = second;
        } else {
            day = first;
            month = second;
        }
    }

    const date = createDateFromParts(
        year,
        month,
        day
    );

    return date ? date.toISOString() : null;
};

const createTransactionFingerprint = transaction =>
    JSON.stringify([
        transaction.text.trim().toLowerCase(),
        transaction.category.trim().toLowerCase(),
        transaction.amount,
        (
            transaction.currency ??
            DEFAULT_CURRENCY
        ).toUpperCase(),
        transaction.date.slice(0, 10)
    ]);

const validateImportedTransaction = transaction => {
    if (!transaction || typeof transaction !== "object") {
        return "Invalid transaction";
    }

    if (
        typeof transaction.text !== "string" ||
        !transaction.text.trim()
    ) {
        return "Description is required";
    }

    if (
        typeof transaction.category !== "string" ||
        !transaction.category.trim()
    ) {
        return "Category is required";
    }

    if (
        typeof transaction.amount !== "number" ||
        !Number.isFinite(transaction.amount) ||
        transaction.amount === 0
    ) {
        return "Amount must be a non-zero number";
    }

    if (
        typeof transaction.date !== "string" ||
        Number.isNaN(
            new Date(transaction.date).getTime()
        )
    ) {
        return "Invalid date";
    }

    if (
        transaction.id === undefined ||
        transaction.id === null
    ) {
        return "Transaction ID is required";
    }

    if (
        typeof transaction.updatedAt !== "number" ||
        !Number.isFinite(transaction.updatedAt)
    ) {
        return "Invalid updatedAt";
    }

    if (
        typeof transaction.updatedBy !== "string" ||
        !transaction.updatedBy.trim()
    ) {
        return "Invalid updatedBy";
    }

    return null;
};

const buildImportedTransaction = row => {
    const text = normalizeText(row.description);
    const category = normalizeText(row.category);
    const amount = parseAmount(row.amount);
    const date = parseDate(row.date);

    const rawCurrency =
        normalizeText(
            row.currency
        ).toUpperCase();

    const currency =
        rawCurrency
            ? rawCurrency
            : DEFAULT_CURRENCY;

    if (!text) {
        return {
            error: "Description is required"
        };
    }

    if (!category) {
        return {
            error: "Category is required"
        };
    }

    if (amount === null) {
        return {
            error: "Amount must be a non-zero number"
        };
    }

    if (
        !isSupportedCurrency(currency)
    ) {
        return {
            error:
                `Unsupported currency: ${currency}`
        };
    }

    if (!date) {
        return {
            error: "Invalid date"
        };
    }

    const now = Date.now();

    const transaction = {
        id: crypto.randomUUID(),
        text,
        category,
        amount,
        currency,
        date,
        updatedAt: now,
        updatedBy: deviceId
    };

    const validationError =
        validateImportedTransaction(transaction);

    if (validationError) {
        return {
            error: validationError
        };
    }

    return {
        transaction
    };
};

export const importFromCSV = async (
    file,
    existingTransactions = [],
    {
        mode = "merge"
    } = {}
) => {
    if (
        mode !== "merge" &&
        mode !== "replace"
    ) {
        throw new Error(
            `Invalid CSV import mode: ${mode}`
        );
    }

    if (!file) {
        throw new Error("No CSV file selected");
    }

    if (
        file.type &&
        file.type !== "text/csv" &&
        !file.name.toLowerCase().endsWith(".csv")
    ) {
        throw new Error("Please select a CSV file");
    }

    const text = await file.text();

    if (!text.trim()) {
        throw new Error("CSV file is empty");
    }

    const rawRows = parseCSV(text);

    if (!rawRows.length) {
        throw new Error("CSV file contains no data");
    }

    const headers = rawRows[0].map(
        normalizeHeader
    );

    const headerIndexes = {};

    headers.forEach((header, index) => {
        headerIndexes[header] = index;
    });

    const missingHeaders =
        REQUIRED_HEADERS.filter(
            header =>
                headerIndexes[header] === undefined
        );

    if (missingHeaders.length) {
        throw new Error(
            `Missing required CSV column(s): ${missingHeaders.join(
                ", "
            )}`
        );
    }

    const existingFingerprints =
        new Set(
            existingTransactions.map(
                createTransactionFingerprint
            )
        );

    const importedFingerprints = new Set();

    const imported = [];
    const errors = [];
    let duplicateCount = 0;

    for (let index = 1; index < rawRows.length; index++) {
        const row = rawRows[index];

        const rowNumber = index + 1;

        const rowObject = {
            description:
                row[headerIndexes.description] ?? "",

            category:
                row[headerIndexes.category] ?? "",

            amount:
                row[headerIndexes.amount] ?? "",

            currency:
                row[
                    headerIndexes.currency
                ] ?? "",

            date:
                row[headerIndexes.date] ?? ""
        };

        /*
         * Completely empty rows are ignored.
         */
        if (
            Object.values(rowObject).every(
                value => !normalizeText(value)
            )
        ) {
            continue;
        }

        const result =
            buildImportedTransaction(rowObject);

        if (result.error) {
            errors.push({
                row: rowNumber,
                error: result.error
            });

            continue;
        }

        const fingerprint =
            createTransactionFingerprint(
                result.transaction
            );

        /*
         * Prevent importing the same CSV twice.
         */
        if (
            existingFingerprints.has(fingerprint) ||
            importedFingerprints.has(fingerprint)
        ) {
            duplicateCount++;
            continue;
        }

        importedFingerprints.add(fingerprint);

        imported.push(result.transaction);
    }

    return {
        transactions: imported,
        errors,
        duplicateCount,
        totalRows: rawRows.length - 1
    };
};
