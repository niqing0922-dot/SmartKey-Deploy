export function DataTable({ columns, rows }: { columns: string[]; rows: React.ReactNode }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
}
