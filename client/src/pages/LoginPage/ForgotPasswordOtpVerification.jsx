import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Box, CircularProgress, Container, Grid, TextField } from "@mui/material";
import { toast } from "sonner";
import Footer from "../../components/Footer";
import { api } from "../../utils/axios";
import logo from "../../assets/WONO_LOGO_Black_TP.svg";
import "./ClientLogin.css";
import "./ClientSpecialClasses.css";

const VERIFY_OTP_HEADING = "Verify OTP";

const ForgotPasswordOtpVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [typedHeading, setTypedHeading] = useState("");
  const [isFormVisible, setIsFormVisible] = useState(false);

  useEffect(() => {
    setTypedHeading("");
    setIsFormVisible(false);

    let headingIndex = 0;
    const headingInterval = setInterval(() => {
      headingIndex += 1;
      setTypedHeading(VERIFY_OTP_HEADING.slice(0, headingIndex));

      if (headingIndex >= VERIFY_OTP_HEADING.length) {
        clearInterval(headingInterval);
        setIsFormVisible(true);
      }
    }, 7);

    return () => clearInterval(headingInterval);
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      const response = await api.post("/api/auth/forgot-password/verify-otp", {
        email,
        otp,
      });
      const sessionToken = response.data?.resetSessionToken || "";
      navigate("/forgot-password/reset", {
        state: {
          email,
          resetSessionToken: sessionToken,
          flow: "forgot-password",
        },
      });
      if (sessionToken) {
        navigate(
          `/forgot-password/reset?email=${encodeURIComponent(email)}&session=${encodeURIComponent(sessionToken)}`,
          {
            state: {
              email,
              resetSessionToken: sessionToken,
              flow: "forgot-password",
            },
            replace: true,
          },
        );
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "OTP verification failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      setIsResending(true);
      const response = await api.post("/api/auth/forgot-password/start", { email });
      toast.success(response.data?.message || "OTP resent successfully.");
      setResendCooldown(30);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900 font-pregular">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-300 shadow-sm">
        <div className="min-w-[75%] max-w-[80rem] mx-0 md:mx-auto px-6 sm:px-6 lg:px-0 flex items-center justify-between py-4">
          <a href="https://wono.co">
            <img src={logo} alt="wono" className="w-36 h-10" />
          </a>
        </div>
      </header>

      <div className="login-section loginTopPadding loginBottomPadding poppinsRegular heightPadding">
        <h1 className="text-center text-4xl font-play min-h-[3rem]">{typedHeading}</h1>
        <div className="loginDividingContainer shrink-container">
          <div className="loginLeftContainer w-full md:w-2/3">
            <Container maxWidth="lg" style={{ padding: "3rem 0 0" }}>
              <p className="text-center text-sm text-gray-700 mb-6">
                {email ? (
                  <>
                    Enter the OTP sent to{" "}
                    <span className="font-semibold text-gray-900">{email}</span>
                  </>
                ) : (
                  "Enter the OTP sent to your email"
                )}
              </p>

              <Box
                component="form"
                sx={{ flexGrow: 1 }}
                onSubmit={handleSubmit}
                noValidate
                autoComplete="off"
                className={isFormVisible ? "visible" : "invisible"}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="w-full lg:col-start-1 lg:col-end-3 lg:max-w-[50%] lg:mx-auto">
                    <TextField
                      label="OTP"
                      variant="standard"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputProps={{ inputMode: "numeric", maxLength: 6 }}
                      required
                      fullWidth
                    />
                  </div>
                </div>
                <div className="mt-2 col-span-2 text-end min-h-[1.5rem]">
                  <div className="w-full lg:max-w-[50%] lg:mx-auto">
                    {resendCooldown > 0 ? (
                      <span className="text-black/60">Resend OTP in {resendCooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        disabled={isResending}
                        onClick={handleResend}
                        className="hover:underline text-black disabled:opacity-50"
                      >
                        {isResending ? "Resending..." : "Resend OTP"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex">
                  <div className="flex flex-col justify-center w-full items-center gap-6 mt-6">
                    <Grid item xs={12}>
                      <div className="centerInPhone">
                        <button
                          disabled={isSubmitting}
                          type="submit"
                          className="loginButtonStyling text-decoration-none text-subtitle font-medium w-40"
                        >
                          {isSubmitting ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Verify"}
                        </button>
                      </div>
                    </Grid>
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

      <Footer />
    </div>
  );
};

export default ForgotPasswordOtpVerification;