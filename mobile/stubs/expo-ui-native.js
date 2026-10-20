const React = require('react');

function passthrough({ children }) {
  return children ?? null;
}

module.exports = {
  IconButton: passthrough,
  Button: passthrough,
  Icon: function Icon() {
    return null;
  },
  Host: passthrough,
  Text: passthrough,
};
