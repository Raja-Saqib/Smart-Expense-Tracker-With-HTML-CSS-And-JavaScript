const escapeCSVValue = value => {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

export const exportToCSV = (data, showError) => {
  if (!data.length) {
    showError("No data to export");
    return;
  }

  const rows = [
    ["Description", "Category", "Amount", "Date"],
    ...data.map(t => [
      t.text,
      t.category,
      t.amount,
      new Date(t.date).toLocaleDateString()
    ])
  ];

  const csv = rows
    .map(row =>
      row.map(escapeCSVValue).join(",")
    )
    .join("\r\n");

  const blob = new Blob(
    [csv],
    {
      type: "text/csv;charset=utf-8"
    }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "transactions.csv";
  link.click();

  URL.revokeObjectURL(url);
};
