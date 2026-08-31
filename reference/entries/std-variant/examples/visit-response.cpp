#include <iostream>
#include <string>
#include <variant>

struct Printer {
    void operator()(int status) const {
        std::cout << "status=" << status << '\n';
    }

    void operator()(const std::string& message) const {
        std::cout << "message=" << message << '\n';
    }
};

int main() {
    std::variant<int, std::string> response = 200;
    std::visit(Printer{}, response);

    response = std::string{"ready"};
    std::visit(Printer{}, response);
}
