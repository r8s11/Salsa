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
          Welcome to Salsa Segura! We are passionate about bringing the joy of Latin dance to
          everyone. Our mission is to create a welcoming community where dancers of all levels can
          learn, grow, and connect.
        </p>

        <section>
          <h2>Our Story</h2>
          <p>
            Founded with a love for Salsa and Bachata, Salsa Segura's goal is to help dancers find
            their rhythm in the Boston social dance community. What started as a simple idea to
            connect dancers across the city has grown into a hub for Latin dance enthusiasts
            throughout New England.
          </p>
        </section>

        <section>
          <h2>What We Offer</h2>
          <ul>
            <li>A hub for dancers all around the New England area</li>
            <li>One-source event calendar for salsa, bachata, and Latin dance</li>
            <li>Pop-up classes and workshop listings</li>
            <li>Instructor directory to find your next teacher</li>
            <li>Community-submitted events to keep the calendar fresh</li>
          </ul>
        </section>

        <section>
          <h2>Our Community</h2>
          <p>
            Whether you are taking your first steps or have been dancing for years, Salsa Segura
            welcomes you. Our platform connects dancers with events, instructors, and each other
            across Greater Boston and beyond.
          </p>
        </section>
      </div>
    </section>
  );
}

export default AboutPage;
