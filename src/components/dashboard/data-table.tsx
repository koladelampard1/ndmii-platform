export function DataTable() {
  const rows = [
    ["NDMII-LAG-0001", "Lagos", "Manufacturing", "Verified"],
    ["NDMII-KAN-0007", "Kano", "Retail", "Pending"],
    ["NDMII-RIV-0013", "Rivers", "Agro-processing", "Verified"],
  ];

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-4 py-3">MSME ID</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3">Sector</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t">
              {row.map((cell) => (
                <td key={cell} className="px-4 py-3">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
