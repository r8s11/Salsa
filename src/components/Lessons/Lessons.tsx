import "./Lessons.css";

const lessons = [
  {
    icon: "👤",
    title: "Private Lessons",
    description:
      "One-on-one personalized instruction tailored to your pace and goals.",
  },
  {
    icon: "💕",
    title: "Couples Sessions",
    description:
      "Perfect for date nights, anniversaries, or just having fun together!",
  },
  {
    icon: "🎉",
    title: "Pop-up Classes",
    description:
      "Join our community pop-up salsa classes at various locations around Massachusetts.",
  },
];

function Lessons() {
  return (
    <section id="lessons" className="lessons">
      <div className="container">
        <h2 className="section-title">Lesson Options</h2>
        <div className="lessons-grid">
          {lessons.map((lesson) => (
            <div key={lesson.title} className="lesson-card">
              <div className="lesson-icon">{lesson.icon}</div>
              <h3>{lesson.title}</h3>
              <p>{lesson.description}</p>
            </div>
          ))}
        </div>
        <div className="quote">
          "Dancing is the hidden language of the soul" - Martha Graham
        </div>
      </div>
    </section>
  );
}

export default Lessons;
