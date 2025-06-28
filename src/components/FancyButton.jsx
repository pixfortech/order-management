// FancyButton.jsx (Premium Animated Version)
import React, { useState } from 'react';
import styled, { keyframes, css } from 'styled-components';

const FancyButton = ({
  defaultText,
  hoverText,
  successText,
  defaultColor,
  hoverColor,
  successColor,
  onClick,
  isSuccess,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = async () => {
    setIsClicked(true);
    await onClick();
    setTimeout(() => setIsClicked(false), 2000);
  };

  const currentText = isSuccess
    ? successText
    : isHovered
    ? hoverText
    : defaultText;

  const currentColor = isSuccess
    ? successColor
    : isHovered
    ? hoverColor
    : defaultColor;

  return (
    <StyledButton
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      bgColor={currentColor}
    >
      <TextWrapper key={currentText}>{currentText}</TextWrapper>
    </StyledButton>
  );
};

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10%); }
  to { opacity: 1; transform: translateY(0); }
`;

const StyledButton = styled.button`
  background-color: ${({ bgColor }) => bgColor};
  color: white;
  font-weight: bold;
  font-size: 1rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 9999px;
  cursor: pointer;
  transition: background-color 0.4s ease;
  overflow: hidden;
  min-width: 130px;
`;

const TextWrapper = styled.span`
  display: inline-block;
  animation: ${fadeIn} 0.4s ease;
`;

export default FancyButton;
