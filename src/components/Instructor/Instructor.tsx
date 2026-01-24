import "./Instructor.css";

const credentials = [
  "8+ Years Dancing Experience",
  "Patient, Encouraging Teaching Style",
  "Bilingual (English/Spanish)",
  "Specializes in Building Confidence",
];

function Instructor() {
  return (
    <section id="instructor" className="instructor">
      <div className="container">
        <h2 className="section-title">Meet Your Instructor</h2>
        <div className="instructor-content">
          <div className="instructor-image">
            <div className="instructor-avatar">
              <img
                src="https://via.placeholder.com/300x300?text=Roosevelt"
                alt="Roosevelt Segura - Dance Instructor"
                className="avatar-img"
              />
            </div>
          </div>
          <div className="instructor-info">
            <h2 className="instructor-name">Roosevelt Segura</h2>
            <h3>Dance Instructor</h3>
            <p>
              With over 8 years of experience performing, I bring authentic
              Latin dance techniques and a passion for teaching to every lesson.
            </p>

            <ul className="credentials">
              {credentials.map((credential) => (
                <li key={credential}>{credential}</li>
              ))}
            </ul>

            <p>
              My teaching philosophy focuses on creating a comfortable,
              judgment-free environment where students can learn at their own
              pace and truly connect with the music and movement.
            </p>

            <div className="social-links">
              <a
                href="https://www.instagram.com/SalsaSegura"
                target="_blank"
                rel="noopener noreferrer"
                className="social-link"
              >
                📱 Follow on Instagram
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Instructor;
