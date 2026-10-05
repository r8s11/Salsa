import "./WorkInProgress.css";

function WorkInProgress() {
  return (
    <div className="wip-container">
      <div className="content">
        <h1 className="font-great-vibes">Salsa Segura</h1>
        <h2>Work in Progress</h2>
        <p>We are currently working on our new website to bring you the best dance experience.</p>
        <p>Stay tuned for updates!</p>
        <div className="contact-info">
          <p>In the meantime, feel free to contact us:</p>
          <a href="mailto:info@salsasegura.com">info@salsasegura.com</a>
          <br />
          <a href="https://www.instagram.com/SalsaSegura" target="_blank" rel="noopener noreferrer">
            @SalsaSegura
          </a>
        </div>
      </div>
    </div>
  );
}

export default WorkInProgress;
