interface Pet {
  id?: number | string;
  name?: string;
  breed?: string;
  status?: string;
}

interface LatestPetsProps {
  pets?: Pet[];
}

const LatestPets = ({ pets = [] }: LatestPetsProps) => {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <h2 style={{ marginBottom: "20px" }}>
        Latest Pets
      </h2>

      {pets.length === 0 ? (
        <p style={{ color: "#94A3B8", fontSize: "14px" }}>
          No pets on record yet.
        </p>
      ) : (
        pets.map((pet, index) => (
          <div
            key={String(pet.id ?? index)}
            style={{
              borderBottom: "1px solid #E5E7EB",
              padding: "15px 0",
            }}
          >
            <h4 style={{ margin: 0 }}>
              {pet.name}
            </h4>

            <p
              style={{
                margin: "6px 0",
                color: "#6B7280",
              }}
            >
              {pet.breed}
            </p>

            <small
              style={{
                color: "#1E3A8A",
              }}
            >
              {pet.status}
            </small>
          </div>
        ))
      )}
    </div>
  );
};

export default LatestPets;