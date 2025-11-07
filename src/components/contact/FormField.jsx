export default function FormField({
  label,
  type,
  name,
  value,
  onChange,
  error,
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700" htmlFor={name}>
        {label}:
      </label>
      {type === "textarea" ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required
          className="w-full rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
        />
      ) : (
        <input
          type={type}
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required
          className="w-full rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
        />
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
