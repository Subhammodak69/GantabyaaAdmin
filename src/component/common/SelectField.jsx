import Select from "react-select";
import { useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { getReactSelectMenuProps, getReactSelectStyles } from "../../hooks/reactSelectConfig";

const mergeSelectStyles = (baseStyles, styles = {}, theme = 'light') => {
  const customStyles = styles || {};
  const keys = new Set([...Object.keys(baseStyles), ...Object.keys(customStyles)]);

  const merged = {};
  keys.forEach((key) => {
    const baseStyle = baseStyles[key];
    const overrideStyle = customStyles[key];

    if (baseStyle && overrideStyle) {
      merged[key] = (provided, state) => overrideStyle(baseStyle(provided, state), state, theme);
    } else {
      merged[key] = overrideStyle || baseStyle;
    }
  });

  return merged;
};

const SelectField = ({ styles, className = '', ...props }) => {
  const { theme } = useTheme();
  const mergedStyles = useMemo(
    () => mergeSelectStyles(getReactSelectStyles(theme), styles, theme),
    [theme, styles]
  );

  return (
    <Select
      key={theme}
      {...getReactSelectMenuProps()}
      {...props}
      className={`w-full min-w-0 ${className}`.trim()}
      styles={mergedStyles}
    />
  );
};

export default SelectField;
