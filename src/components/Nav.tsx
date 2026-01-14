import { NavLink } from "react-router-dom"

export default function default Nav({ menuItem }) {


    return (
        <li>
            <NavLink to=`"{{ navAddress }}"`
                onClick={closeMenu}
            className={({isActive }) => (isActive ? 'active' : "")}>

            </NavLink>
        </li>
    )
}
