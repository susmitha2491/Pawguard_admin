interface PrimaryButtonProps {
  text: string;
  onClick?: () => void;
}

const PrimaryButton = ({ text, onClick }: PrimaryButtonProps) => {
  return (
    <button
      onClick={onClick}
      style={{
        background: "#1E3A8A",
        color: "#FFFFFF",
        border: "none",
        padding: "10px 18px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
        lineHeight: "20px",
        fontWeight: 600,
        transition: "background-color 0.15s ease",
      }}
    >
      {text}
    </button>
  );
};

export default PrimaryButton;