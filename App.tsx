/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-4xl font-bold">
        ZA Media AI Growth Engine
      </h1>

      <p className="mt-2 text-slate-300">
        AI Business Operating System Dashboard
      </p>

      <div className="grid md:grid-cols-4 gap-6 mt-10">
        <Card title="Leads" value="0" />
        <Card title="Qualified" value="0" />
        <Card title="Pipeline" value="$0" />
        <Card title="Revenue" value="$0" />
      </div>

      <div className="mt-10 bg-slate-900 rounded-xl p-6">
        <h2 className="text-xl font-semibold">
          AI Operations Center
        </h2>
        <p className="text-slate-400 mt-2">
          Lead intake • Qualification • CRM • Follow-up • Analytics
        </p>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-slate-900 rounded-xl p-6">
      <div className="text-slate-400">{title}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}
