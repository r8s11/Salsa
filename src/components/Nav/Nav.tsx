import { NavLink } from "react-router-dom";

type NavProps = {
    menuItem: {
        label: string;
        navAddress: string;
    };
    closeMenu: () => void;
};

export default function Nav({ menuItem, closeMenu }: NavProps) {
    return (
        <li>
            <NavLink
                to={menuItem.navAddress}
                onClick={closeMenu}
                className={({ isActive }: { isActive: boolean }) => (isActive ? 'active' : "")}
            >
                {menuItem.label}
            </NavLink>
        </li>
    );
}
