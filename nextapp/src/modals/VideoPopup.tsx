
"use client";
import React, { useState } from "react";
import { Modal } from "react-responsive-modal";
import "react-responsive-modal/styles.css";

const VideoPopup = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);

  const onOpenModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };
  const onCloseModal = () => setOpen(false);

  return (
    <div>
      <div onClick={onOpenModal}>{children}</div>
      <Modal
        open={open}
        onClose={onCloseModal}
        center
        styles={{ modal: { padding: "0px", width: "800px", maxWidth: "90vw" } }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: "56.25%",
            height: 0,
          }}
        >
          <iframe
            src="https://www.youtube.com/embed/Q5PG0rMXgvw"
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
          ></iframe>
        </div>
      </Modal>
    </div>
  );
};

export default VideoPopup;


