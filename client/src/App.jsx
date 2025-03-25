import { Footer } from "./components/footer";
import { Messages } from "./components/messages";

function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden mx-auto bg-blue-100 gap-4">
      <Messages />
      <Footer />
    </div>
  );
}

export default App;
