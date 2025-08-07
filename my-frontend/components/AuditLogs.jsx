import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const { get } = useApi();

  useEffect(() => {
    get("/logs").then(setLogs);
  }, []);

  return (
    <div className="p-6 text-white">
      <h2 className="text-xl font-bold mb-4">Audit Logs</h2>
      <ul>
        {logs.map((log) => (
          <li key={log.id} className="mb-2 text-sm">
            {log.timestamp}: {log.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
