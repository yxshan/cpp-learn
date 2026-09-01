#include <iostream>
#include <sstream>

class StreamBufferGuard {
public:
    StreamBufferGuard(std::ostream& stream, std::streambuf* replacement)
        : stream_{stream}, original_{stream.rdbuf(replacement)} {}

    ~StreamBufferGuard() { stream_.rdbuf(original_); }

    StreamBufferGuard(const StreamBufferGuard&) = delete;
    StreamBufferGuard& operator=(const StreamBufferGuard&) = delete;

private:
    std::ostream& stream_;
    std::streambuf* original_;
};

int main() {
    std::ostringstream captured;
    {
        StreamBufferGuard guard{std::cerr, captured.rdbuf()};
        std::cerr << "error=" << 7;
    }
    std::cout << "captured=" << captured.str() << '\n';
}
