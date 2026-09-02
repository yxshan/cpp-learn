#include <iostream>
#include <memory>

class Service : public std::enable_shared_from_this<Service> {
public:
  explicit Service(int id) : id_(id) {}

  std::shared_ptr<Service> share() {
    return shared_from_this();
  }

  int id() const noexcept {
    return id_;
  }

private:
  int id_;
};

int main() {
  auto owner = std::make_shared<Service>(42);
  auto from_member = owner->share();

  const bool same_owner =
      !owner.owner_before(from_member) && !from_member.owner_before(owner);

  std::cout << std::boolalpha;
  std::cout << "same_owner=" << same_owner << '\n';
  std::cout << "owners=" << owner.use_count() << '\n';
  std::cout << "id=" << from_member->id() << '\n';
}
