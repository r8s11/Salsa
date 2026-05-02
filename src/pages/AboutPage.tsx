import "./AboutPage.css";

function AboutPage() {
  return (
    <section className="about-page">
      <div className="container">
        <h1>About Salsa Segura</h1>

        <div className="about-rule" aria-hidden="true">
          <span className="about-rule-line" />
          <span className="about-rule-diamond">&#9670;</span>
          <span className="about-rule-line" />
        </div>

        <p>
          Welcome to Salsa Segura — a community of dancers inviting everyone into the joy of Latin
          dance. This is a place for dancers of all levels to learn, grow, and connect, whether
          you're in Greater Boston or New York City.
        </p>

        <section>
          <h2>The Story</h2>
          <p>
            Born from a love of Salsa and Bachata, Salsa Segura is a gathering place for dancers
            finding their rhythm in the social dance community. What began as a simple idea to
            connect dancers across Boston has grown into a hub for Latin dance enthusiasts across
            Greater Boston and New York City.
          </p>
        </section>

        <section>
          <h2>What You'll Find</h2>
          <ul>
            <li>A hub for dancers across Greater Boston and NYC</li>
            <li>One-source event calendar for salsa, bachata, and Latin dance</li>
            <li>Pop-up classes and workshop listings</li>
            <li>Instructor directory to find your next teacher</li>
            <li>Community-submitted events to keep the calendar fresh</li>
          </ul>
        </section>

        <section>
          <h2>A Place for Everyone</h2>
          <p>
            Whether you are taking your first steps or have been dancing for years, Salsa Segura
            welcomes you. The community connects dancers with events, instructors, and each other
            across Greater Boston, New York City, and beyond.
          </p>
        </section>
      </div>
    </section>
  );
}

export default AboutPage;
