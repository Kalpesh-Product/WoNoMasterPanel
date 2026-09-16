import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Container, Box, TextField } from "@mui/material";
import { toast } from "sonner";
import { api } from "../../utils/axios";
import "./ClientLogin.css";
import "./ClientSpecialClasses.css";
import Footer from "../../components/Footer";
import { CircularProgress } from "@mui/material";
import { Drawer } from "@mui/material";
import { IoCloseSharp } from "react-icons/io5";
import logo from "../../assets/WONO_LOGO_Black_TP.svg";

const FORGOT_PASSWORD_HEADING = "Forgot Password?";

const ForgotPassword = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [typedHeading, setTypedHeading] = useState("");
  const [isFormVisible, setIsFormVisible] = useState(false);

  React.useEffect(() => {
    setTypedHeading("");
    setIsFormVisible(false);

    let headingIndex = 0;
    const headingInterval = setInterval(() => {
      headingIndex += 1;
      setTypedHeading(FORGOT_PASSWORD_HEADING.slice(0, headingIndex));

      if (headingIndex >= FORGOT_PASSWORD_HEADING.length) {
        clearInterval(headingInterval);
        setIsFormVisible(true);
      }
    }, 7);

    return () => clearInterval(headingInterval);
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsPending(true);
      const response = await api.post("/api/auth/forgot-password/start", { email });
      toast.success(response.data?.message || "OTP sent to your email");
      navigate("/forgot-password/verify", {
        state: { email, flow: "forgot-password" },
      });
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to send email. Please try again.",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="shadow-md bg-white/80 backdrop-blur-md">
        <div className="min-w-[75%] max-w-[80rem] lg:max-w-[80rem] mx-0 md:mx-auto px-6 sm:px-6 lg:px-0 ">
          <div className=" flex justify-between items-center py-3 ">
            <a href="https://wono.co">
              <img src={logo} alt="wono" className="w-36 h-10" />
            </a>
            <div className="" />
          </div>
        </div>
      </div>
      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <div className="w-full bg-black text-white flex justify-end items-center border-b border-gray-700 p-4 text-2xl">
          <button type="button" onClick={() => setDrawerOpen(false)}>
            <IoCloseSharp />
          </button>
        </div>
        <div className="w-96 h-screen p-6 flex flex-col gap-8 items-center uppercase bg-black text-white text-center">
          <div
            className="cursor-pointer hover:text-gray-400"
            onClick={() => setDrawerOpen(false)}
          >
            <a href="https://wono.co/" className="block w-full uppercase">
              Home
            </a>
          </div>
          <hr className="w-[80%] text-gray-300" />
          <div className="flex flex-col w-full items-center gap-6">
            <div>
              <Link
                to="/"
                className="block px-10 py-2 uppercase bg-white text-black mx-auto w-max rounded-full"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </Drawer>
      {/* Header */}
      <div className="login-section loginTopPadding loginBottomPadding poppinsRegular heightPadding min-h-screen">
        <h1 className="text-center text-4xl font-play min-h-[3rem]">{typedHeading}</h1>
        <div className="loginDividingContainer shrink-container">
          <div className="loginLeftContainer w-full md:w-3/4">
            <Container
              maxWidth="lg"
              style={{ padding: "3rem 0 0" }}
            >
              <Box
                component="form"
                sx={{ flexGrow: 1 }}
                onSubmit={onSubmit}
                noValidate
                autoComplete="off"
                className={isFormVisible ? "visible" : "invisible"}
              >
                <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 w-4/5 md:w-1/2 mx-auto">
                  <div>
                    <TextField
                      label="Email"
                      variant="standard"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      fullWidth
                    />
                  </div>
                </div>
                <div className="mt-6 col-span-2 text-end min-h-[1.5rem]" />
                <div className="flex">
                  <div className="flex flex-col justify-center w-full items-center gap-6 mt-6">
                    <div>
                      <div className="centerInPhone">
                        <button
                          disabled={isPending}
                          type="submit"
                          className="loginButtonStyling text-decoration-none text-subtitle font-medium w-40"
                        >
                          {isPending ? (
                            <CircularProgress size={20} sx={{ color: "white" }} />
                          ) : (
                            "Send"
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-[0.9rem]">
                      Already have an account?{" "}
                      <Link to="/" className="underline hover:text-primary">
                        Login
                      </Link>
                    </p>
                  </div>
                </div>
              </Box>
            </Container>
          </div>
        </div>
      </div>
      <div>
        <Footer />
      </div>
    </>
  );
};

export default ForgotPassword;
