import React, { useState } from 'react';
import OrderForm from './OrderForm';
import OrderTabs from './OrderTabs';
import OrderSummary from './OrderSummary';
import SettingsPanel from './SettingsPanel';
import styled from 'styled-components';
import { useSwipeable } from 'react-swipeable';
import { ClipboardList, FileText, LayoutDashboard, Settings } from 'lucide-react';

const tabOrder = ['order', 'orders', 'summary', 'settings'];
const tabIcons = {
  order: <ClipboardList size={18} />,
  orders: <FileText size={18} />,
  summary: <LayoutDashboard size={18} />,
  settings: <Settings size={18} />,
};

const MainLayout = ({ isAdmin }) => {
  const [activeTab, setActiveTab] = useState('order');

  const handleSwipe = (direction) => {
    const currentIndex = tabOrder.indexOf(activeTab);
    let nextIndex = currentIndex;

    if (direction === 'LEFT' && currentIndex < tabOrder.length - 1) {
      nextIndex = currentIndex + 1;
    } else if (direction === 'RIGHT' && currentIndex > 0) {
      nextIndex = currentIndex - 1;
    }

    if (nextIndex !== currentIndex) {
      setActiveTab(tabOrder[nextIndex]);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleSwipe('LEFT'),
    onSwipedRight: () => handleSwipe('RIGHT'),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'order':
        return <OrderForm />;
      case 'orders':
        return <OrderTabs />;
      case 'summary':
        return <OrderSummary />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  return (
    <Container {...swipeHandlers}>
      <TabsWrap>
        {tabOrder.map((tab, idx) => (
          <React.Fragment key={tab}>
            <input
              hidden
              className={`rd-${idx}`}
              name="tab"
              id={`tab-${tab}`}
              type="radio"
              checked={activeTab === tab}
              onChange={() => setActiveTab(tab)}
            />
            <label className="label" htmlFor={`tab-${tab}`}>
              <span>
                {tabIcons[tab]} &nbsp;
                {tab === 'order' ? 'Current Order' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </span>
            </label>
          </React.Fragment>
        ))}
        <div className="bar" style={{ transform: `translateX(${tabOrder.indexOf(activeTab) * 100}%)` }} />
        <div className="slidebar" style={{ transform: `translateX(${tabOrder.indexOf(activeTab) * 100}%)` }} />
      </TabsWrap>
      <TabContent>{renderTabContent()}</TabContent>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  align-items: center;
`;

const TabContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  width: 100%;
`;

const TabsWrap = styled.div`
  --round: 10px;
  --p-x: 8px;
  --p-y: 4px;
  --w-label: 130px;
  --theme: #49488D;
  display: flex;
  align-items: center;
  padding: var(--p-y) var(--p-x);
  position: relative;
  background: #f9f9f9;
  border-radius: var(--round);
  max-width: 90%;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  top: 0;
  z-index: 1;
  margin-top: 8px;

  input {
    display: none;
  }

  .label {
    cursor: pointer;
    outline: none;
    font-size: 0.875rem;
    font-weight: bold;
    color: #333;
    background: transparent;
    padding: 12px 16px;
    width: var(--w-label);
    min-width: var(--w-label);
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
    -webkit-tap-highlight-color: transparent;
    border-top: 0 solid transparent;
    border-bottom: 2px solid transparent;
    transition: background-color 0.3s ease, border-bottom 0.3s ease;
  }

  .label:hover::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: #5f5ea340;
    z-index: -1;
    border-radius: var(--round);
  }

  input:checked + .label {
    color: var(--theme);
    border-bottom: 3px solid var(--theme);
  }

  .bar,
  .slidebar {
    position: absolute;
    height: calc(100% - (var(--p-y) * 4));
    width: var(--w-label);
    border-radius: calc(var(--round) - var(--p-y));
    background: #f0f0f0;
    transform-origin: 0 0 0;
    z-index: 0;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateZ(0);
    backface-visibility: hidden;
    will-change: transform;
  }

  .bar {
    background: var(--theme);
    height: 3px;
    width: var(--w-label);
    top: 100%;
    border-radius: 9999px 9999px 0 0;
  }
`;

export default MainLayout;
