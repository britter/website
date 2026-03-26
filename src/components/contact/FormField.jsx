export default function FormField({
  label,
  type,
  name,
  value,
  onChange,
  error,
}) {
  const inputStyle = {
    backgroundColor: "var(--color-surface-container-low)",
    borderColor: "var(--color-outline-variant)",
    color: "var(--color-on-surface)",
    fontFamily: "var(--font-sans)",
  };

  const sharedClasses =
    "w-full border px-3 py-2 text-sm transition-colors focus:outline-none";

  return (
    <div className="mb-5">
      <label
        className="mb-1.5 block text-xs font-bold tracking-widest uppercase"
        style={{
          color: "var(--color-on-surface-variant)",
          fontFamily: "var(--font-label)",
        }}
        htmlFor={name}
      >
        {label}
      </label>
      {type === "textarea" ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required
          rows={4}
          className={sharedClasses}
          style={inputStyle}
        />
      ) : (
        <input
          type={type}
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required
          className={sharedClasses}
          style={inputStyle}
        />
      )}
      {error && (
        <p
          className="mt-1 text-xs"
          style={{ color: "#e53e3e", fontFamily: "var(--font-mono)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
