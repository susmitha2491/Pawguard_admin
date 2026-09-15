interface PageHeaderProps {
  title: string;
  subtitle: string;
}

const PageHeader = ({ title, subtitle }: PageHeaderProps) => {
  return (
    <div style={{ marginBottom: "20px" }}>
      <h1
        style={{
          fontSize: "24px",
          lineHeight: "32px",
          fontWeight: 700,
          color: "#0F172A",
          letterSpacing: "-0.015em",
          marginBottom: "4px",
        }}
      >
        {title}
      </h1>

      <p
        style={{
          color: "#475569",
          fontSize: "14px",
          lineHeight: "20px",
          margin: 0,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
};

export default PageHeader;