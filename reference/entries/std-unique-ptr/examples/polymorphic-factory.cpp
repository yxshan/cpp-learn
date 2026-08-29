#include <iostream>
#include <memory>
#include <string_view>

class Service {
public:
    virtual ~Service() = default;
    [[nodiscard]] virtual std::string_view name() const = 0;
};

class Worker final : public Service {
public:
    [[nodiscard]] std::string_view name() const override {
        return "worker";
    }
};

std::unique_ptr<Service> make_service() {
    return std::make_unique<Worker>();
}

int main() {
    const std::unique_ptr<Service> service = make_service();
    std::cout << service->name() << '\n';
}
