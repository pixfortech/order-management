import React, { useState } from 'react';

const EnhancedButton = ({
  children,
  variant = 'primary',
  size = 'default',
  disabled = false,
  onClick = () => {},
  className = '',
  icon = null,
  hoverText = 'Processing...',
  completedText = '✔ Done',
  type = 'button',
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = async (e) => {
    if (disabled) return;
    setIsClicked(true);
    try {
      await onClick(e); // Support async and sync onClick functions
    } catch (err) {
      console.error("Error during button click:", err);
    }
    setTimeout(() => setIsClicked(false), 2000);
  };

  const getVariantStyles = (variant) => {
    const variants = {
      primary: { bg: '#49488D', hover: '#34336b' },
      success: { bg: '#28a745', hover: '#218838' },
      danger: { bg: '#dc3545', hover: '#c82333' },
      warning: { bg: '#ffc107', hover: '#e0a800' },
      secondary: { bg: '#6c757d', hover: '#5a6268' },
    };
    return variants[variant] || variants.primary;
  };

  const { bg, hover } = getVariantStyles(variant);
  const height = size === 'sm' ? '2.4rem' : size === 'lg' ? '3.8rem' : '3.2rem';
  const padding = size === 'sm' ? '0.4rem 1rem' : size === 'lg' ? '0.8rem 2rem' : '0.6rem 1.5rem';
  const fontSize = size === 'sm' ? '0.9rem' : size === 'lg' ? '1.1rem' : '1rem';

  return (
    <button
      type={type}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      style={{
        all: 'unset',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: isHovered ? hover : bg,
        transition: 'all 0.3s ease',
        color: '#fff',
        fontWeight: 600,
        borderRadius: '2rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
        fontSize,
        minWidth: '120px',
        boxShadow: isHovered
          ? '0 4px 8px rgba(0, 0, 0, 0.1)'
          : '0 2px 5px rgba(0, 0, 0, 0.08)',
        height,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
      className={`enhanced-button ${className}`}
      {...props}
    >
      {icon && <span style={{ marginRight: '0.5rem' }}>{icon}</span>}
      {isClicked ? completedText : isHovered ? hoverText : children}
    </button>
  );
};

export default EnhancedButton;
