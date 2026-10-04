import React, { useState, useEffect } from "react";
import {
  House,
  Package,
  FileText,
  ScrollText,
  ShieldCheck,
  Users,
  MapPin,
  Building2,
  HelpCircle,
  BadgePercent,
  Gift,
  Car,
  Receipt,
  CalendarCheck,
  Wallet,
  BarChart3,
  Coins,
  Archive,
} from "lucide-react";
import { useLocation, Link } from "react-router-dom";

const Sidebar = ({
  isMobile,
  sidebarOpen,
  toggleSidebar,
  onHover,
  isExpanded,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
 
  const menuSections = [
    {
      label: "Overview",
      items: [
        { icon: House, label: "Dashboard", path: "/" },
        { icon: BarChart3, label: "Analytics", path: "/analytics" },
      ],
    },
    {
      label: "People & Sales",
      items: [
        { icon: ShieldCheck, label: "Staff Management", path: "/staff-management" },
        { icon: Users, label: "Customers", path: "/customers" },
        { icon: Gift, label: "Referrals", path: "/referrals" },
        { icon: Coins, label: "Points & Loyalty", path: "/points" },
        { icon: HelpCircle, label: "Enquiries", path: "/enquiries" },
        { icon: Receipt, label: "Quotations", path: "/quotations" },
      ],
    },
    {
      label: "Operations",
      items: [
        { icon: CalendarCheck, label: "Bookings", path: "/bookings" },
        { icon: Wallet, label: "Financial Management", path: "/financial" },
        { icon: Archive, label: "Backups", path: "/backups" },
        { icon: FileText, label: "Document Management", path: "/document-management" },
      ],
    },
    {
      label: "Travel Inventory",
      items: [
        { icon: Package, label: "Tour Packages", path: "/tour-packages" },
        { icon: BadgePercent, label: "Tour Offers", path: "/tour-offers" },
        { icon: MapPin, label: "Destinations", path: "/destinations" },
        { icon: ScrollText, label: "Rules & Regulations", path: "/rules-regulations" },
        { icon: Building2, label: "Hotels", path: "/hotels" },
        { icon: BadgePercent, label: "Vendors", path: "/vendors" },
        { icon: Car, label: "Vehicles", path: "/vehicles" },
      ],
    },
  ];

  const isActiveRoute = (itemPath) => {
    return currentPath === itemPath || (itemPath !== "/" && currentPath.startsWith(itemPath + "/"));
  };

  useEffect(() => {
    if (onHover && !isMobile) {
      onHover(isHovered);
    }
  }, [isHovered, onHover, isMobile]);

  if (isMobile) {
    return (
      <>
        <div
          className={`
          fixed left-0 top-16 z-30 w-72 h-[calc(100vh-4rem)]
          bg-white dark:bg-gray-900 transform transition-transform duration-300 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          overflow-y-auto overflow-x-hidden shadow-2xl
        `}
        >
          <div className="p-4">
            <nav className="space-y-5">
              {menuSections.map((section) => (
                <section key={section.label}>
                  <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{section.label}</h2>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                const isActive = isActiveRoute(item.path);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => toggleSidebar()}
                    className={`
                      flex items-center px-3 py-3 rounded-2xl transition-all duration-200 mb-1
                      ${isActive
                        ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 text-blue-700 dark:text-blue-300"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400"
                      }
                    `}
                  >
                    <div
                      className={`
                      p-2 rounded-2xl mr-3
                      ${isActive
                          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                        }
                    `}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
                    })}
                  </div>
                </section>
              ))}
            </nav>
          </div>
        </div>
      </>
    );
  }

  const isSidebarExpanded = isExpanded;

  const renderMenuItem = (item, isExpandedState) => {
    const isActive = isActiveRoute(item.path);
    const Icon = item.icon;

    return (
      <Link
        key={item.label}
        to={item.path}
        className={`
          flex items-center rounded-2xl transition-all duration-200 group
          ${isExpandedState ? "px-3 py-2.5 gap-3" : "px-0 py-2.5 justify-center"}
          ${isActive
            ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400"
          }
        `}
        title={!isExpandedState ? item.label : ""}
      >
        <div
          className={`
          p-2 rounded-2xl transition-all duration-200
          ${isExpandedState ? "" : "mx-auto"}
          ${isActive
              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/50 group-hover:text-blue-600 dark:group-hover:text-blue-400"
            }
        `}
        >
          <Icon className="w-4 h-4" />
        </div>
        {isExpandedState && (
          <>
            <span
              className={`flex-1 text-sm font-medium ${isActive ? "font-semibold" : ""}`}
            >
              {item.label}
            </span>
            {isActive && (
              <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
            )}
          </>
        )}
        {!isExpandedState && isActive && (
          <span className="absolute left-0 w-1 h-8 bg-blue-600 rounded-r-full"></span>
        )}
      </Link>
    );
  };

  const handleMouseEnter = () => {
    if (!isSidebarExpanded) {
      setIsHovered(true);
      if (onHover) onHover(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (onHover) onHover(false);
  };

  return (
    <div
      className={`
        fixed left-0 top-16 z-20 bg-white dark:bg-gray-900
        transition-all duration-300 ease-out
        ${isSidebarExpanded ? "w-64" : "w-16"}
        h-[calc(100vh-4rem)]
        shadow-lg dark:shadow-black/30 border-r border-gray-200 dark:border-gray-800
        overflow-y-auto overflow-x-hidden
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-col h-full">
        <nav className="flex-1 space-y-4 px-2 py-5">
          {menuSections.map((section, sectionIndex) => (
            <section key={section.label} className={sectionIndex > 0 ? "border-t border-gray-200 pt-3 dark:border-gray-800" : ""}>
              {isSidebarExpanded && (
                <h2 className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{section.label}</h2>
              )}
              <div className="space-y-1">
                {section.items.map((item) => renderMenuItem(item, isSidebarExpanded))}
              </div>
            </section>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
