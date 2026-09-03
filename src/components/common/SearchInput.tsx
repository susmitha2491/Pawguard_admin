interface SearchInputProps {
  placeholder?: string;
}

const SearchInput = ({
  placeholder = "Search...",
}: SearchInputProps) => {
  return (
    <input
      type="text"
      placeholder={placeholder}
      aria-label={placeholder}
      style={{
        width: "320px",
        padding: "9px 14px",
        borderRadius: "8px",
        border: "1px solid #E2E8F0",
        color: "#0F172A",
        fontSize: "14px",
        lineHeight: "20px",
        boxSizing: "border-box",
        transition: "border-color 0.15s ease",
      }}
    />
  );
};

export default SearchInput;