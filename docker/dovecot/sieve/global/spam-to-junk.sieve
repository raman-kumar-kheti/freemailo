require ["fileinto"];

# Move spam-flagged messages to Junk folder
if header :contains "X-Spam" "Yes" {
  fileinto "Junk";
  stop;
}
