import "./Footer.css";

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer>
      <div className="footer-content">
        <div className="footer-links">
          <a href="https://www.instagram.com/SalsaSegura" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <a href="mailto:info@SalsaSegura.com">Email</a>
          <a href="tel:+19784440922">Call</a>
        </div>

        <a
          href="https://www.buymeacoffee.com/rseg"
          className="bmc-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=rseg&button_colour=059669&font_colour=ffffff&font_family=Poppins&outline_colour=059669&coffee_colour=FFDD00"
            alt="Buy me a coffee"
          />
        </a>

        <div className="copyright">
          &copy; {currentYear} Salsa Segura. All rights reserved. | Greater Boston &amp; NYC |
          Passion For Dance
        </div>
      </div>
    </footer>
  );
}

export default Footer;
