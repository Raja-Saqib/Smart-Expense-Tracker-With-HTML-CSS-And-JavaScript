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
    .map(row => row.join(","))
    .join("\n");

  const blob = new Blob(
    [csv],
    { type: "text/csv" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "transactions.csv";
  link.click();

  URL.revokeObjectURL(url);
};
