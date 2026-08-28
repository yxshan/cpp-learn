#include <iostream>
#include <memory>
#include <string>
#include <utility>

class Formatter {
public:
    virtual ~Formatter() = default;
    virtual std::string format(int value) const = 0;
};

class PrefixedFormatter final : public Formatter {
public:
    explicit PrefixedFormatter(std::string prefix)
        : prefix_(std::move(prefix)) {}

    std::string format(int value) const override {
        return prefix_ + std::to_string(value);
    }

private:
    std::string prefix_;
};

std::unique_ptr<Formatter> make_formatter() {
    return std::make_unique<PrefixedFormatter>("request-");
}

int main() {
    std::unique_ptr<Formatter> formatter = make_formatter();
    std::cout << formatter->format(42) << '\n';
}
